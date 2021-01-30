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

	if(abs(ost) <= E) return s*size;
	if(s > 0.0) return (size - fr)*1.001;
	return -fr*1.001;
}

float find_a(float a, float b, float p) {
	return (p - a) / (b - a);
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
		vec3 reflection_dir = normal_cs*cos_between_normal_and_ray*2 - into_camera;

		vec3 reflection_b_ws = cam_to_win(position_cs + reflection_dir/100, proj);

		vec2 reflection_dir_ws = normalize((reflection_b_ws-position_ws).xy);

		//float x_to_y = reflection_dir_ws.x / reflection_dir_ws.y;
		float z_to_x = reflection_dir.z / reflection_dir.x;

		float z_numerator = (position_cs.z - z_to_x*position_cs.x);
		float z_denominator = 1 + (z_to_x*((position_ws.x / frxu_size.x) *2 - 1 + proj[2][0])/proj[0][0]);
		float z_denominator_addition = ((z_to_x*reflection_dir_ws.x/frxu_size.x)*2)/proj[0][0];

		float steps = 150;
		//float av_lod = 0;
		//float switches = 0;
		/*						*/
		vec2 dir = reflection_dir_ws;

		if(dir.x == 0) { dir.x == 0.001; dir = normalize(dir); }
		if(dir.y == 0) { dir.y == 0.001; dir = normalize(dir); }

		int prim = abs(dir.x) >= abs(dir.y) ? 0 : 1;
		int sec = 1 - prim;

		ivec2 idir = ivec2(sign(dir));

		float prim_to_sec = dir[prim] / dir[sec];
		float sec_to_prim = dir[sec] / dir[prim];

		float dist_per_prim = 1 / dir[prim];

		float level = 1;
		int lod = 0;

		vec2 cur = position_ws.xy + dir;
		if(dir.x > 0 && dir.y > 0) cur += dir/2.0;
		float dist = length(cur - position_ws.xy);
		
		while(true) {
		while(true) {
			ivec2 coord = ivec2( cur/level );

			vec2 uv = (cur/(frxu_size*level) - 0.5);
			float closeness_to_border = max(abs(uv.y), abs(uv.x)) * 2;
			if(closeness_to_border >= 1) return;

			float denom = ( z_denominator + z_denominator_addition*dist );
			float z_cs = z_numerator / denom;
			float z_ws = z_cam_to_win(z_cs, proj);

			while(lod < 4) {
				float up_depth_ws = texelFetch(u_depth, coord/4, lod).r;

				if(up_depth_ws <= z_ws ) break;
				
				level *= 4.0;
				++lod;
				coord = ivec2( cur/level );
			}

			float depth_ws = -1;

			while(true) {
				depth_ws = texelFetch(u_depth, coord, lod).r;

				if(z_ws < depth_ws ) break;

				if(lod == 0) {
					gl_FragData[0] = texelFetch(u_main, coord, 0);
					return;
				}

				level /= 4.0;
				--lod;
				coord = ivec2( cur/level );
			}

			float new_dist = -1;
			vec2 new = vec2(0);
			float a = 0;

			while(true) {
				new = cur;

				float prim_dist = dist_f(new[prim], level, dir[prim]);
				float sec_dist = dist_f(new[sec], level, dir[sec]);

				float sec_to_prim0 = sec_dist / prim_dist;

				if(abs(sec_to_prim0 - sec_to_prim) < E) {
					new[prim] += prim_dist;
					new[sec] += sec_dist;
				}
				else if(abs(sec_to_prim0) < abs(sec_to_prim)) {
					new[sec] += sec_dist;
					new[prim] += prim_to_sec * sec_dist;
				}
				else {
					new[prim] += prim_dist;
					new[sec] += sec_to_prim * prim_dist;
				}

				new_dist = dist + dist_per_prim * (new[prim] - cur[prim]);

				denom = ( z_denominator + z_denominator_addition*new_dist );
				float new_z_cs = z_numerator / denom;
				float new_z_ws = z_cam_to_win(new_z_cs, proj);

				a = find_a(z_ws, new_z_ws, depth_ws);

				bool upper = new_z_ws <= z_ws;
				bool collides = a <= 1;

				if(collides && lod == 0) {
					gl_FragData[0] = texelFetch(u_main, coord, 0);
					return;
				}
				
				if(!collides || upper) break;

				level /= 4.0;
				--lod;

				coord = ivec2( cur/level );
				depth_ws = texelFetch(u_depth, coord, lod).r;
			}

			cur += (new - cur)*clamp(a, 0, 1.01);
			dist += (new_dist - dist)*clamp(a, 0, 1.01);

			--steps;
			if(steps <= 0) return;
		}
	}
	}

	gl_FragData[0] = mix(texture2D(u_main, _cvv_texcoord), reflection_color, ratio);
}