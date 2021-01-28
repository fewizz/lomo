#include frex:shaders/api/header.glsl
#extension GL_ARB_bindless_texture : require
#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/reflection.frag */

uniform sampler2D u_reflective;

uniform sampler2D u_main;
uniform sampler2D u_depth;

varying vec2 _cvv_texcoord;

int prim_diff_f(float v0, float diff) {
	float v1 = v0 + diff;
	float mx = max(v0, v1);
	float mn = min(v0, v1);

	return int(ceil(mx)) - int(floor(mn));
}

float closest_for(float v0, float d) {
	float s = sign(d);
	float fr = fract(v0);

	if(fr == 0.0) return s;
	if(s > 0.0) return 1.0 - fr;
	return - fr;
}

float closest_back(float v0, float d) {
	float s = sign(d);
	float fr = fract(v0);

	if(fr == 0.0) return s;
	if(s > 0.0) -fr;
	return 1.0 - fr;
}

/*int check(vec2 dir, int dim, ivec2 cell_n) {
	if(dir[dim] != 0.0) return -1;
	int other_dim = 1 - dim;

	float stp = sign(dir[other_dim]);
	float off = 0.5*stp;

	for(
		float i = 0.0;
		float(i * FCELL_SIZE) < CHECK_DIST;
		i++
	) {
		ivec2 v = ivec2(0);

		v[other_dim] = int(floor(stp*i + off));

		if(v == cell_n) return COLLIDES;
	}
	return NOT_COLLIDES;
}*/
int real_lod(int lod) {
	//if(lod > 0) return lod - 1;
	return lod / 2;
}

float center(float begin, float end, int i) {
	float s = sign(end - begin);

	if(i == 0) return closest_for(begin, s) / 2.0;

	return 
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
		
		vec2 position = position_ws.xy;

		float dist = 0;
		//int level = 8;
		float x_to_y = reflection_dir_ws.x / reflection_dir_ws.y;


		vec2 tex_uv = position / frxu_size;

		float z_to_x = reflection_dir.z / reflection_dir.x;

		float z_numerator = (position_cs.z - z_to_x*position_cs.x);
		float z_denominator = 1 + (z_to_x*(tex_uv.x*2 - 1 + proj[2][0])/proj[0][0]);
		float z_denominator_addition = ((z_to_x*reflection_dir_ws.x/frxu_size.x)*2)/proj[0][0];

		float steps = 300;

		/*						*/
		vec2 dir = reflection_dir_ws;

		if(dir.x == 0) dir.x == 0.001;
		if(dir.y == 0) dir.y == 0.001;

		int prim = abs(dir.x) > abs(dir.y) ? 0 : 1;
		int sec = 1 - prim;

		ivec2 idir = ivec2(sign(dir));

		float prim_to_sec = dir[prim] / dir[sec];
		float sec_to_prim = dir[sec] / dir[prim];

		vec2 cur = vec2(0.5);//dir*0.5;//vec2(0);//vec2(0.5);

		int level = 16;
		int lod = 4;

		while(true) {
			float sec_diff = closest_for(cur[sec], dir[sec]);
			float prim_diff = prim_to_sec*sec_diff;

			int steps_l = prim_diff_f(cur[prim], prim_diff);
			ivec2 stp = ivec2(0);
			stp[prim] = idir[prim];

			//float real_x = cur.x;

			for( int i = 0; i < steps_l; i++ ) {
				ivec2 icur = ivec2(floor(cur)) + stp*i;
				dist = length(vec2(icur*float(level)));
				//real_x = 

				cur.x += closest_for(cur[prim], dir[prim]);

				float denom = ( z_denominator + z_denominator_addition*dist );
				float z = z_numerator / denom;
				//z += 0.02;
				float zw = z_cam_to_win(z, proj);

				//tex_uv = (position_ws.xy + reflection_dir_ws*dist)*level / frxu_size;
				ivec2 coord = icur+ivec2(position_ws.xy/level);

				//vec2 uv = (vec2(coord)/frxu_size - 0.5);
				///float closeness_to_border = max(abs(uv.y), abs(uv.x)) * 2;
				//if(closeness_to_border >= 1) return;

				float win_s_depth = texelFetch(u_depth, coord, real_lod(lod)).r;//texture2D(u_depth, tex_uv).r;

				// We hit the ground
				if(win_s_depth < zw) {
					ratio = 1;

					if(lod == 0) {
						gl_FragData[0] = texelFetch(u_main, coord, 0);
						return;
					}
					else {
						//float done = float(i) / float(steps_l);
						float x = float(i);
						cur[prim] += x;
						cur[sec] += x*sec_to_prim;

						prim_diff = 0.0;
						sec_diff = 0.0;

						level = level / 4;
						lod -= 2;
						cur *= 4.001;//textureSize(u_depth, lod) / textureSize(u_depth, lod + 1);
						break;
					}
					//reflection_color = texture2D(u_main, tex_uv);
					//return;
				}

				steps = steps - 1;
				if(steps <= 0) return;

			}

			cur[prim] += prim_diff;
			cur[sec] += sec_diff*1.001;

			steps = steps - 1;
			if(steps <= 0) return;
		}
	}

	gl_FragData[0] = mix(texture2D(u_main, _cvv_texcoord), reflection_color, ratio);
}