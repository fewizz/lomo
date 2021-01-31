#include frex:shaders/api/header.glsl
#extension GL_ARB_bindless_texture : require
#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/reflection.frag */

uniform sampler2D u_reflective;

uniform sampler2D u_main;
uniform sampler2D u_depth;

varying vec2 _cvv_texcoord;

#define E 0.002

float dist_f(float v0, float size, float d) {
	float s = sign(d);
	float fr = fract(v0/size)*size;
	float C = 1.01;

	if(abs(fr) <= E) return s*size*C;
	if(s > 0.0) return (size - fr)*C;
	return -fr*C;
}

float find_a(float a, float b, float p) {
	return (p - a) / (b - a);
}

struct reflection_result {
	bool success;
	vec4 color;
	float a;
};

reflection_result reflect(vec3 pos_cs, vec3 dir_cs, vec2 pos_ws, vec2 dir_ws) {
	int prim_cs = abs(dir_cs.x) >= abs(dir_cs.y) ? 0 : 1;
	float z_to_prim = 0;
	if(dir_cs[prim_cs] == 0) z_to_prim = 1/0.0000001;
	else z_to_prim = dir_cs.z / dir_cs[prim_cs];

	mat4 proj = frx_projectionMatrix();
	mat4 view = frx_viewMatrix();

	float z_numerator = (pos_cs.z - z_to_prim*pos_cs[prim_cs]);
	float z_denominator = 1 + (z_to_prim * ((pos_ws[prim_cs] / frxu_size[prim_cs]) * 2 - 1 + proj[2][prim_cs]) / proj[prim_cs][prim_cs]);
	float z_denominator_addition = ((z_to_prim * dir_ws[prim_cs] / frxu_size[prim_cs]) * 2) / proj[prim_cs][prim_cs];

	float steps = 400;

	vec2 dir = dir_ws;

	if(dir.x == 0) { dir.x == 0.0001; dir = normalize(dir); }
	if(dir.y == 0) { dir.y == 0.0001; dir = normalize(dir); }

	int prim = abs(dir.x) >= abs(dir.y) ? 0 : 1;
	int sec = 1 - prim;

	ivec2 idir = ivec2(sign(dir));

	float prim_to_sec = dir[prim] / dir[sec];
	float sec_to_prim = dir[sec] / dir[prim];

	float dist_per_prim = 1 / dir[prim];
	float dist_per_sec = 1 / dir[sec];

	float level = 1;
	int lod = 0;

	vec2 cur = pos_ws.xy + dir;
	//if(dir.x > 0 && dir.y > 0) cur += dir/2.0;
	float dist = length(cur - pos_ws.xy);
	
	//while(true) {
	while(true) {
		ivec2 coord = ivec2( cur/level );

		/*vec2 magic = (cur/(frxu_size*level)) * 2 - 1;
		float closeness_to_border = max(abs(magic.x), abs(magic.y));
		if(closeness_to_border >= 0.95) return reflection_result(false, vec4(0), 0);*/
		//if(coord.x <= 0 || coord.y <= 0 || coord.x >= (frxu_size/level).x || coord.y >= (frxu_size/level).y ) {
		if(cur.x < 0 || cur.y <= 0 || cur.x >= frxu_size.x || cur.y >= frxu_size.y ) {
			return reflection_result(false, vec4(0), 0);
		}

		float denom = ( z_denominator + z_denominator_addition*dist );
		float z_cs = z_numerator / denom;
		float z_ws = z_cam_to_win(z_cs, proj);
		//z_ws -= 0.0005;

		if(z_ws >= 1 || z_ws <= 0) return reflection_result(false, vec4(0), 0);

		while(lod < 4) {
			float up_depth_ws = texelFetch(u_depth, coord/4, lod+1).r;

			if(up_depth_ws <= z_ws ) break;
			
			level *= 4.0;
			++lod;
			coord = ivec2( cur/level );
		}

		float depth_ws = -1;
		float depth_cs = -1;
		while(true) {
			depth_ws = texelFetch(u_depth, coord, lod).r;
			depth_cs = z_win_to_cam(depth_ws, proj);

			if(z_cs > depth_cs) break;

			if(lod == 0) {
				/*mat3 rotation = mat3(view);
				vec4 packed_normal = texture2D(u_reflective, _cvv_texcoord);
				vec3 normal = normalize((packed_normal.xyz - 0.5) * 2);
				vec3 normal_cs = rotation*normal;

				vec2 normal_ws = dir_cam_to_win(win_to_cam(vec3(cur, z_ws), proj), normal_cs, proj);
				float res = dot(normal_ws, dir_ws);

				if(res >= 0) return reflection_result(false, vec4(0), 0);
				//float depth_cs = z_win_to_cam(depth_ws, proj);
				//float depth_cs = z_win_to_cam(depth_ws, proj);*/

				//if(depth_cs - z_cs > 0.2) return reflection_result(false, vec4(0), 0);//reflection_result(true, vec4(1), 1);

				vec4 color = texelFetch(u_main, coord, 0);
				float ratio = 1;//clamp(1 - closeness_to_border*closeness_to_border, 0, 1);
				return reflection_result(true, color/*vec4(1,0,0,0)*/, ratio);
			}

			level /= 4.0;
			--lod;
			coord = ivec2( cur/level );
		}

		float a = 0;
		float dist_add = 0;

		while(true) {
			float prim_dist = dist_f(cur[prim], level, dir[prim]);
			float sec_dist = dist_f(cur[sec], level, dir[sec]);

			float sec_to_prim0 = sec_dist / prim_dist;

			if(abs(sec_to_prim0) < abs(sec_to_prim)) dist_add = sec_dist*dist_per_sec;
			else dist_add = prim_dist*dist_per_prim;

			denom = ( z_denominator + z_denominator_addition * (dist + dist_add) );
			float new_z_cs = z_numerator / denom;
			float new_z_ws = z_cam_to_win(new_z_cs, proj);

			a = find_a(z_cs, new_z_cs, depth_cs);

			bool collides = a <= 1.05;
			bool collides_lod_0 = (z_ws >= depth_ws || (collides && new_z_ws >= depth_ws));

			if(lod == 0) {
				if(collides_lod_0) {
					//if(abs(depth_ws - new_z_ws) > 0.0008) return reflection_result(true, vec4(1,0,0,1), 1);
					//if(a >= 1.1 )
					vec4 color = texelFetch(u_main, coord, 0);
					//float ratio = clamp(1 - closeness_to_border*closeness_to_border, 0, 1);
					float ratio = 1;
					return reflection_result(true, color/*vec4(0,0,1,0)*/, ratio);
				}
				a = 1;
				break;
			}

			bool backward = new_z_ws <= z_ws;
			if(!collides || backward) {
				a = 1;
				break;
			}

			level /= 4.0;
			--lod;

			coord = ivec2( cur/level );
			depth_ws = texelFetch(u_depth, coord, lod).r;
		}

		cur += dir*dist_add*a;
		dist += dist_add*a;

		--steps;
		if(steps <= 0) return reflection_result(false, vec4(0), 0);
	}
}

void main() {
	vec4 packed_normal = texture2D(u_reflective, _cvv_texcoord);

	vec4 reflection_color = vec4(0);
	float ratio = 0;

	if(packed_normal.a != 0) {
		vec3 normal = normalize((packed_normal.xyz - 0.5) * 2);
		mat4 view = frx_viewMatrix();
		mat4 proj = frx_projectionMatrix();

		float depth_ws = texture2D(u_depth, _cvv_texcoord).r ;
		vec3 position_ws = vec3(gl_FragCoord.xy, depth_ws);
		vec3 position_cs = win_to_cam(position_ws, proj);

		mat3 rotation = mat3(view);
		vec3 normal_cs = normalize(rotation * normal);

		vec3 into_camera = normalize(-position_cs);
		float cos_between_normal_and_ray = dot(into_camera, normal_cs);
		vec3 reflection_dir = reflect(normalize(position_cs), normal_cs);//normal_cs*cos_between_normal_and_ray*2 - into_camera;

		//vec3 reflection_b_ws = cam_to_win(position_cs + reflection_dir/4, proj);

		vec2 reflection_dir_ws = dir_cam_to_win(position_cs, reflection_dir, proj);//normalize((reflection_b_ws-position_ws).xy);

		reflection_result res = reflect(position_cs, reflection_dir, position_ws.xy, reflection_dir_ws);

		if(res.success) {
			reflection_color = res.color;

			//float sin_between_normal_and_ray = sqrt(1 - cos_between_normal_and_ray*cos_between_normal_and_ray);
			ratio = res.a;//*sin_between_normal_and_ray;
			//return;
		}
	}

	gl_FragData[0] = mix(texture2D(u_main, _cvv_texcoord), reflection_color, ratio);
}