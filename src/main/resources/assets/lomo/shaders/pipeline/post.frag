#version 330

#extension GL_ARB_bindless_texture : require
#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/post_experimental.frag */

uniform sampler2D u_reflective;

uniform sampler2D u_main;
uniform sampler2D u_depth;

in vec2 _cvv_texcoord;
out vec4 out_color;

struct reflection_result {
	bool success;
	vec4 color;
	float a;
};

#define CELL_SIZE 4
#define MAX_LEVELS 4

const int last_level 
	= MAX_LEVELS;/*clamp(
		int(log2(max(frxu_size.x, frxu_size.y)) / 2.0 - 0.5),
		0,
		MAX_LEVELS
	);*/
float cells_for_level(int lod) {
	return pow(CELL_SIZE, lod);
}

float dist_f(float v0, int lod, float d) {
	float cells = cells_for_level(lod);
	float s = sign(d);
	float fr = fract(v0 / cells) * cells;
	const float E = 0.02;
	const float C = 1.0 + E;

	if(abs(fr) <= E) return s * cells * C;
	if(s > 0.0) return (cells - fr) * C;
	return -fr * C;
}

ivec2 texture_coord_for_lod(vec2 coord_lod_0, int lod) {
	return ivec2(coord_lod_0 / cells_for_level(lod));
}

float upper_depth(ivec2 coord, int lod) {
	if(lod < last_level)
		return texelFetch(u_depth, coord / CELL_SIZE, lod + 1).r;
	return 0.0;
}

reflection_result reflection0(vec3 dir_ws, vec3 pos_ws) {
	/*float z =
		z_cam_to_lin_win(pos_cs.z + dir_cs.z, proj)
		-
		cam_to_lin_win(pos_cs.z, proj);*/

	return reflection_result(
		true,
		vec4(
			vec3(dir_ws.z*1000),//abs(dir_ws.z) * 50000),
			//abs(dir_ws.x),
			//abs(dir_ws.y),
			//abs(dir_ws.z) * 50000,
			1
		),
		1
	);

}
reflection_result reflection(vec3 dir_ws, vec3 pos_ws) {
	mat4 proj = frx_projectionMatrix();
	//mat4 view = frx_viewMatrix();

	// primary dimension in world space
	//int prim_cs = abs(dir_cs.x) >= abs(dir_cs.y) ? 0 : 1;
	//vec3 position_cs = lin_win_to_cam(pos_ws, proj);
	//vec3 dir_ws = dir_cam_to_lin_win(position_cs, dir_cs, proj);
	// z per primary in camera space, needed for math below
	//float z_to_prim = 0.0;
	//if(dir_cs[prim_cs] == 0.0) z_to_prim = 1/0.0000001;
	//else z_to_prim = dir_cs.z / dir_cs[prim_cs];

	// it took me whole day
	//pos_cs.z += 0.002;
	//float z_numerator = (pos_cs.z - z_to_prim * pos_cs[prim_cs]);
	//float z_denominator = 1.0 + (z_to_prim * ((pos_ws[prim_cs] / frxu_size[prim_cs]) * 2.0 - 1.0 + proj[2][prim_cs]) / proj[prim_cs][prim_cs]);
	//float z_denominator_addition = ((z_to_prim * dir_ws[prim_cs] / frxu_size[prim_cs]) * 2.0) / proj[prim_cs][prim_cs];

	// window space direction of reflected ray
	vec2 dir = normalize(dir_ws.xy);

	// that's possible
	if(dir.x == 0) { dir.x == 0.0001; dir = normalize(dir); }
	if(dir.y == 0) { dir.y == 0.0001; dir = normalize(dir); }

	// primary dimension in window space
	int prim = abs(dir.x) >= abs(dir.y) ? 0 : 1;
	// secondary
	int sec = 1 - prim;

	ivec2 idir = ivec2(sign(dir));

	// primary per secondary
	float prim_to_sec = dir[prim] / dir[sec];
	// secondary per primary
	float sec_to_prim = dir[sec] / dir[prim];

	float dist_per_prim = 1 / dir[prim];
	float dist_per_sec = 1 / dir[sec];

	float dist = 1; // 1 - length of dir
	// current windows space position
	vec2 cur = floor(pos_ws.xy) + vec2(0.5) + dir*dist;
	// distance from initial position

	// z of upper cell
	//float upper_depth_ws = 0;
	int lod = 0;

	// texture coord for current lod
	ivec2 coord = texture_coord_for_lod(cur, lod);

	// z in camera space
	//float z_cs = z_numerator / (z_denominator + z_denominator_addition * dist);
	// z in window space
	//float z_origin_ws = pos_ws.z;//texelFetch(u_depth, coord, lod).r - 0.001;
	float z_ws = pos_ws.z;//z_cam_to_win(z_cs, proj);
	float upper_depth_ws = 0;

	bool backwards = dir_ws.z <= 0;

	int steps = 0;
	while(true) {
		// are we out from framebuffer?
		if(
			cur.x <= 0 || cur.y <= 0 ||
			cur.x >= frxu_size.x || cur.y >= frxu_size.y ||
			z_ws >= 1 || z_ws <= 0
		) {
			return reflection_result(false, vec4(0), 0);
		}

		// should we use lower lod?
		float depth_ws = texelFetch(u_depth, coord, lod).r;
		while((z_ws > depth_ws || (!backwards && z_ws == depth_ws)) && lod > 0) {
			--lod;
			coord = texture_coord_for_lod(cur, lod);
			upper_depth_ws = depth_ws;
			depth_ws = texelFetch(u_depth, coord, lod).r;
		}

		// should we use higher lod?
		while((z_ws < upper_depth_ws || (backwards && z_ws == upper_depth_ws)) && lod < last_level) {
			++lod;
			coord = texture_coord_for_lod(cur, lod);
			depth_ws = upper_depth_ws;
			upper_depth_ws = upper_depth(coord, lod);
		}

		float dist_add = 0;
		//float new_z_cs = -1;
		float new_z_ws = -1;

		while(true) {
			float prim_dist = dist_f(cur[prim], lod, dir[prim]);
			float sec_dist = dist_f(cur[sec], lod, dir[sec]);

			float sec_to_prim0 = sec_dist / prim_dist;

			if(abs(sec_to_prim0) < abs(sec_to_prim))
				dist_add = sec_dist * dist_per_sec;
			else
				dist_add = prim_dist * dist_per_prim;

			//new_z_cs =
			//	z_numerator /
			//	(z_denominator + z_denominator_addition * (dist + dist_add));
			
			//new_z_ws = z_cam_to_win(new_z_cs, proj);
			//float z_per_xy = dir_ws.z / length(dir_ws.xy); 
			new_z_ws = z_ws + (dist_add*dir_ws.z) / length(dir_ws.xy);

			bool collides = new_z_ws > depth_ws;

			if(lod == 0) {
				if(collides) {
					vec4 color = texelFetch(u_main, coord, 0);
					float ratio = 1;
					return reflection_result(
						true,
						color,//mix(color, vec4(0, 0, 1, 1), steps/50.0),
						ratio
					);
				}
				break;
			}

			if(!collides || backwards)
				break;

			--lod;
			coord = texture_coord_for_lod(cur, lod);
			upper_depth_ws = depth_ws;
			depth_ws = texelFetch(u_depth, coord, lod).r;
		}

		z_ws = new_z_ws;
		//z_cs = new_z_cs;
		vec2 prev = cur;
		cur += dir*dist_add;
		coord = texture_coord_for_lod(cur, lod);
		dist += dist_add;

		int cells = int(cells_for_level(lod + 1));

		if(ivec2(prev) / cells != ivec2(cur) / cells)
			upper_depth_ws = upper_depth(coord, lod);

		if(steps++ > 100)
			return reflection_result(true, vec4(0), 1);
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

		float depth_ws = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r ;
		vec3 position_ws = vec3(gl_FragCoord.xy, depth_ws);
		vec3 position_cs = lin_win_to_cam(position_ws, proj);

		mat3 rotation = mat3(view);
		vec3 normal_cs = normalize(rotation * normal);

		vec3 reflection_dir = reflect(normalize(position_cs), normal_cs);//normal_cs*cos_between_normal_and_ray*2 - into_camera;

		//vec3 reflection_b_ws = cam_to_win(position_cs + reflection_dir/4, proj);

		//vec2 reflection_dir_ws = dir_cam_to_win(position_cs, reflection_dir, proj);//normalize((reflection_b_ws-position_ws).xy);

		//uint depth_bits = floatBitsToUint(position_ws.z);
		//depth_bits -= 0xFFu;

		//position_ws.z = uintBitsToFloat(depth_bits);

		vec3 dir_ws = cam_dir_to_lin_win(position_cs, reflection_dir, proj);

		reflection_result res = reflection(dir_ws, position_ws);

		if(res.success) {
			reflection_color = res.color;

		//#if REFLECTION_SOFT_EDGE = LOMO_REFLECTION_SOFT_EDGE_TRUE
		//	vec3 into_camera = normalize(-position_cs);
		//	float cos_between_normal_and_ray = dot(into_camera, normal_cs);
		//	float sin_between_normal_and_ray = sqrt(1 - cos_between_normal_and_ray*cos_between_normal_and_ray);
			ratio = 1;//res.a;//*sin_between_normal_and_ray;
			//return;
		}
	}

	out_color = mix(texture(u_main, _cvv_texcoord), reflection_color, ratio);
}